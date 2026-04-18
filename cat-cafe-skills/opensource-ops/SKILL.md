---
name: opensource-ops
description: >
  开源社区运营全链路：Issue Triage、社区 PR 评估/合入/吸收、Outbound Sync、标签归档、Hotfix。
  Use when: 社区 issue/PR 来了、要 sync 到开源仓、要 intake 社区代码、整理标签/归档。
  Not for: 内部 cat-cafe 开发（用 worktree/tdd）、内部 review（用 request-review）。
  Output: 社区运营操作完成 + ledger/标签/文档同步。
---

# Open-Source Ops — 开源社区运营

## 双仓边界（贯穿规则）

| | cat-cafe（家） | clowder-ai（开源仓） |
|---|---|---|
| 本质 | 内部开发仓（alpha/dev） | 公开发布仓 |
| BACKLOG / feature doc | ✅ 在这里维护 | ❌ 不存在 |
| feature 标签 `feature:Fxxx` | ❌ 不在这打 | ✅ 在这里打 |
| Issue triage | ❌ | ✅ 社区 issue 在这里 |
| 社区 PR review + merge | ❌ | ✅ 先在这里合 |
| Intake（回流到家里） | ✅ 在这里执行 | ❌ |
| Outbound sync | ✅ 从这里发出 | ✅ 接收端 |
| 此 skill 本身 | ✅ 内部 playbook | ❌ **不同步出去** |

**每个操作步骤标注 `[cat-cafe]` 或 `[clowder-ai]`。**
**所有开源仓评论/操作带猫猫签名（如 `缅因猫-gpt5.4`）。**

## 发布线口径（贯穿规则）

| 线 | 角色 | 允许内容 |
|---|---|---|
| `cat-cafe main` | 真相源 / canary / 快速演进 | 家里的新能力、共享逻辑、source-owned 修复 |
| `clowder-ai main` | rolling stable 默认分支 | 默认可装、默认可跑、默认可解释的公开内容 |
| `clowder-ai` release tag (`vX.Y.Z`) | 对外稳定承诺 | 给普通用户的稳定版本锚点 |
| `clowder-ai next` / prerelease | 预览通道 | 激进但未完全稳定的社区特性、RC/nightly |

**执行铁律：**
- 社区里激进但还不够稳的特性，**不直接进 `clowder-ai main`**
- 方向对但稳定性/文档/测试还不够 → 走 `next` / prerelease；如果当前没有 active `next`，就保持 PR / feature branch，不强行合并
- `clowder-ai main` 的目标不是"最新"，而是"默认可装、默认可跑、默认可解释"
- 普通用户默认跟 `release tag`，不是跟 `main`

## 场景路由

根据触发条件进入对应场景：

| 触发 | 场景 | 详细文档 |
|------|------|---------|
| **Repo Inbox 通知到达**（F141） | **首反 SOP → A 或 B** | [refs/repo-inbox.md](../refs/repo-inbox.md) |
| PR 冲突通知 (`github-conflict`) | **处理冲突** | 尝试 rebase，复杂冲突通知铲屎官。详见 [refs/pr-signals.md](../refs/pr-signals.md) |
| Review feedback 通知 (`github-review-feedback`) | **处理 review** | 按 `receive-review` 流程处理。详见 [refs/pr-signals.md](../refs/pr-signals.md) |
| 社区 issue 来了 | **A: Issue Triage** | [refs/opensource-ops-issue-triage.md](../refs/opensource-ops-issue-triage.md) |
| 社区 PR 提交到 clowder-ai | **B: Inbound PR** | [refs/opensource-ops-inbound-pr.md](../refs/opensource-ops-inbound-pr.md) |
| 我们往开源仓提 PR | **C: Outbound PR** | [refs/opensource-ops-outbound-pr.md](../refs/opensource-ops-outbound-pr.md) |
| 定期全量同步到开源仓 | **D: Outbound Sync** | [refs/opensource-ops-outbound-sync.md](../refs/opensource-ops-outbound-sync.md) |
| 整理标签、归档 issue | **E: Label & 归档** | [refs/opensource-ops-labels.md](../refs/opensource-ops-labels.md) |
| 社区报 bug，精准修复 | **F: Hotfix Lane** | [refs/opensource-ops-hotfix.md](../refs/opensource-ops-hotfix.md) |

## 场景骨架

### A: Issue Triage

1. `[clowder-ai]` 读 issue → 判断类型（bug / feature / enhancement / duplicate）
2. `[cat-cafe]` + `[clowder-ai]` **主人翁 Gate**（含关联检测）→ 五问判定 → WELCOME / NEEDS-DISCUSSION / POLITELY-DECLINE
3. `[clowder-ai]` 打标签 + 互链相关 issue
4. `[cat-cafe]` 如果是新 Feature：BACKLOG 加条目（Source=community）
5. 详细步骤 → [Issue Triage 文档](../refs/opensource-ops-issue-triage.md) | 判定卡 → [主人翁五问](../refs/ownership-gate.md)

### B: Inbound PR（评估 → 合入 → 吸收）

1. `[clowder-ai]` **Merge Gate**：accepted issue? → **方向(五问)?** → 质量? → intake 预判?
2. `[clowder-ai]` Merge 执行（Patch 自主 / Feature 升级铲屎官）
3. `[cat-cafe]` **Intake Gate**：Intake Intent Issue（逐 file 决策） → `plan` → 执行吸收 → **Intake Review Guard** → `record + advance-ledger` → merge absorb PR（auto-close Intake Intent Issue）
4. 详细步骤 → [Inbound PR 文档](../refs/opensource-ops-inbound-pr.md)

### C: Outbound PR

1. `[cat-cafe]` 确认 PR 类型 → 查官方 F 编号 → 本地编号对齐
2. `[cat-cafe]` Feature Doc 校验 + 质量门禁（`pnpm check` + `pnpm lint` + `test:public`）
3. `[clowder-ai]` 组装 PR（conventional commit 格式）
4. `[clowder-ai]` PR 创建后注册 PR tracking（CI 自动追踪，需要 prNumber）
5. 详细步骤 → [Outbound PR 文档](../refs/opensource-ops-outbound-pr.md)

### D: Outbound Sync

1. `[cat-cafe]` Baseline Verification + **Community Diff Guard** + Pre-sync gate + diff preview
2. `[cat-cafe]` `sync-to-opensource.sh` 先导出到 temp target，并在 temp target 跑完整 public gate
3. `[cat-cafe → clowder-ai]` 只有 temp target public gate 全绿，才允许真实 sync 到 `clowder-ai`
4. `[clowder-ai]` PR 记录必须列清同步了哪些 feat/bugfix/改动
5. `[clowder-ai]` **Post-sync 社区收敛**：按 Feature 分包搜关联 issue → 两猫对齐 → 逐包推铲屎官核验 → 执行关单/打标签
6. 详细步骤 → [Outbound Sync 文档](../refs/opensource-ops-outbound-sync.md)

### E: Label & 归档

1. `[clowder-ai]` 按标签真相源表打标签（区分 GitHub label vs 概念分类）
2. `[clowder-ai]` 互链 + 收口关单
3. 详细步骤 → [Labels 文档](../refs/opensource-ops-labels.md)

### F: Hotfix Lane

1. `[cat-cafe]` Worktree 基于 sync tag → 修 bug
2. `[cat-cafe → clowder-ai]` `sync-hotfix.sh` → clowder-ai PR + 注册 PR tracking（CI 自动追踪）
3. `[cat-cafe]` Cherry-pick 回 main → intake `record + 立刻尝试 advance-ledger`
4. 详细步骤 → [Hotfix 文档](../refs/opensource-ops-hotfix.md)

## 关键原则

1. **Issue accept 是 Merge 前提**：无 accepted issue 不得 merge
2. **Merge ≠ Intake**：merge 进开源仓 ≠ 回流到家里，两个独立决策
3. **Merge 前预判 Intake 类型**：`absorbed` / `public-only` / `manual-port`
4. **Patch 自主 merge 4 条件**：① accepted issue ② safe-cherry-pick 或 public-only ③ CI 过 ④ 不涉及工具链/安全。否则升级铲屎官
5. **一条线不断裂**：Issue accept → Merge decision → Merge → Intake decision → Ledger record
6. **Record + Advance 是一个闭环**：做完 `--record` 就立刻尝试 `--advance-ledger`；如果 advance 失败，说明还有别的 PR 没登记，不能停在半路
7. **source gate green ≠ target/public gate green**：full sync 前必须在家里的 temp target 上跑 public gate；真实 `clowder-ai` 不能再当第一轮验收场
8. **release provenance 三点映射必须显式化**：release-intended full sync 要在 source 侧自动打 `clowder-vX.Y.Z-source`，`.sync-provenance.json` 必须记录 `release_tag` / `source_snapshot_tag`，后续 target release tag 和 backport commit 才有锚点
9. **稳定承诺只由 release tag 给出**：`clowder-ai main` 是 rolling stable；真正的 stable/support 口径以 `vX.Y.Z` release 为准
10. **release 出 bug 优先走 patch**：shared bug 先回家修再 sync 出 `vX.Y.(Z+1)`；public-only hotfix 可以先在 `clowder-ai` 修，但 sync-managed 文件必须回补到家里
11. **full sync 是长跑门禁，不是中途 checkpoint**：一旦 `sync-to-opensource.sh` 进入 temp target public gate（install / `pnpm check` / `pnpm lint` / `build` / `test:public` / startup acceptance），执行中的猫必须持续等待到脚本给出明确成功或失败结果；禁止在 `Step 5` 半路以"到 `test:public` 了""CI 还没开"之类的中间状态退出或汇报完成
12. **🛡 Intake 必须跑 Inbound Guard（Brand Guard）**：outbound sync 有 sanitizer（Cat Cafe → Clowder AI），intake 必须有**反向守卫**——cherry-pick/port 进来的文件不能带着开源仓的品牌覆盖家里的品牌标识。`intake-from-opensource.sh --pr N --mode=plan` 会自动检测 brand-sensitive 文件并发出 `🛡 BRAND GUARD` 警告。手工 cherry-pick 也必须在 commit 前跑 `bash scripts/intake-from-opensource.sh --validate-inbound`
13. **Brand Identity 保护清单**：以下文件包含家里的品牌标识，intake 时**绝不能**用开源仓版本直接覆盖，必须手工对照 diff 只取逻辑改动、保留家里的品牌值：

| 文件 | 保护内容 | 家里的值 | 开源仓的值（sanitizer 产物） |
|------|---------|---------|---------------------------|
| `packages/web/src/app/layout.tsx` | `title` / `description` / `icons` / `appleWebApp.title` | `Cat Cafe` / 三只 AI 猫猫的协作空间 / favicon+icon 声明 | `Clowder AI` / English desc / 只有 apple-touch-icon |
| `packages/web/public/manifest.json` | `name` / `short_name` / `description` | `Cat Cafe` / `猫猫` / 三只 AI 猫猫的协作空间 | 可能被替换 |
| `packages/web/src/components/SplitPaneView.tsx` | `<h1>` 品牌名 | `Cat Cafe` 相关 | `Clowder AI` |
| `packages/web/src/components/ChatContainerHeader.tsx` | `INTERNAL_BASENAMES` 数组 | 包含 `cat-cafe` | 可能被修改 |
| `packages/web/src/utils/api-client.ts` | CORS origins / 域名 | 双仓域名共存 | 可能只有开源仓域名 |
| `packages/web/public/icons/*` | favicon.svg / icon-*.png | 家里的三猫 logo | 可能不同 |

14. **recorded ≠ absorbed-complete**：ledger 里有 `absorbed` 记录只证明"看过了"，不证明"intake 完整"。complete 的判定标准：Intake Intent Issue 里每个 `absorb` 文件都有对应的 commit，且 reviewer 对照 Intent Issue 签字确认。事故来源：clowder-ai#290 sync 覆盖了 clowder-ai#276 的社区修复——ledger 记了 absorbed 但只 intake 了 5 个文件中的 1 个
15. **Intake = 小 Feature，有 spec 有 review**：`absorbed` 决策的社区 PR 必须在 cat-cafe 建 Intake Intent Issue（逐 file 决策表），实现后走 `request-review` 让 reviewer 对照 Issue 验收。详见 [Inbound PR 文档](../refs/opensource-ops-inbound-pr.md) Step 0 + Step 2.5
16. **Outbound sync 前必须过 Community Diff Guard**：sync 前检查 clowder-ai 上是否有已 merge 但未完整 intake 的社区 PR，且其改动文件与 sync diff 有交集。交集不为空 = 会覆盖社区修复 → 必须先完成 intake 再 sync。详见 [Outbound Sync 文档](../refs/opensource-ops-outbound-sync.md) Step 1.5
17. **Intake Intent Issue 必须闭环关闭**：absorb PR 的 body 必须写 `Closes #<intake-issue>`（同仓 auto-close 语法），让 issue 在 merge 时自动关闭；如果 merge 后 issue 仍 open，必须立刻手工关闭。open issue = intake 仍处于半状态。
18. **🧬 伪 Fxxx 锚点 = 认知投毒（Feat Anchor Guard）**：`docs/features/Fxxx-*.md` 是家里知识图谱的根真相源。PR / commit / 代码注释里出现的每一个 `Fxxx` 都必须对应一个真实 feature doc。社区 PR 常把 issue `#NNN` 误写成 `FNNN`，或借 "F-pilot / F-phase" 自造编号；这些伪锚点一旦被 intake 进家，reviewer / 新猫会把它当成"方向已拍板"的证据，跳过方向评估（家规 P4 违反）。Inbound PR B1 Gate 的 ①-b Feat Anchor Guard 必做：扫 PR diff + body 里所有 `F[0-9]{2,4}` → 核 `docs/features/` → 伪锚点 = 请作者改写 `#NNN` 或删除；家里历史污染 = 校正后再 port + 开 cleanup issue。**不以伪 Fxxx 当决策论据。** 事故来源：clowder-ai#507 讨论中 maintainer 猫用伪锚点 `pre-F340` 当 #506 决策论据，实际 `F340` 是代码注释里把 issue #340 写成 `FNNN` 格式的误用（正确 ref 应为 `clowder-ai#340`），shared types 散布 13 处。详见 [Inbound PR 文档](../refs/opensource-ops-inbound-pr.md) ①-b。

## 和其他 skill 的区别

| 容易混淆 | 用哪个 |
|---------|--------|
| 内部 cat-cafe PR 合入 main | `merge-gate` |
| 内部猫间 review | `request-review` / `receive-review` |
| 新 Feature 立项 | `feat-lifecycle`（但社区 issue 的关联检测会 ref 过来） |
| 纯代码开发 | `worktree` + `tdd` |
