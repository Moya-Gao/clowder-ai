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

## 场景路由

根据触发条件进入对应场景：

| 触发 | 场景 | 详细文档 |
|------|------|---------|
| 社区 issue 来了 | **A: Issue Triage** | [refs/opensource-ops-issue-triage.md](../refs/opensource-ops-issue-triage.md) |
| 社区 PR 提交到 clowder-ai | **B: Inbound PR** | [refs/opensource-ops-inbound-pr.md](../refs/opensource-ops-inbound-pr.md) |
| 我们往开源仓提 PR | **C: Outbound PR** | [refs/opensource-ops-outbound-pr.md](../refs/opensource-ops-outbound-pr.md) |
| 定期全量同步到开源仓 | **D: Outbound Sync** | [refs/opensource-ops-outbound-sync.md](../refs/opensource-ops-outbound-sync.md) |
| 整理标签、归档 issue | **E: Label & 归档** | [refs/opensource-ops-labels.md](../refs/opensource-ops-labels.md) |
| 社区报 bug，精准修复 | **F: Hotfix Lane** | [refs/opensource-ops-hotfix.md](../refs/opensource-ops-hotfix.md) |

## 场景骨架

### A: Issue Triage

1. `[clowder-ai]` 读 issue → 判断类型（bug / feature / enhancement / duplicate）
2. `[clowder-ai]` 关联检测（ref `feat-lifecycle` Step 0）→ 是否已有 Feature 覆盖
3. `[clowder-ai]` 打标签 + 互链相关 issue
4. `[cat-cafe]` 如果是新 Feature：BACKLOG 加条目（Source=community）
5. 详细步骤 → [Issue Triage 文档](../refs/opensource-ops-issue-triage.md)

### B: Inbound PR（评估 → 合入 → 吸收）

1. `[clowder-ai]` **Merge Gate**：accepted issue? → 质量? → 方向? → intake 预判?
2. `[clowder-ai]` Merge 执行（Patch 自主 / Feature 升级铲屎官）
3. `[cat-cafe]` **Intake Gate**：`intake-from-opensource.sh --pr N --mode=plan` → 执行吸收 → `record + 立刻尝试 advance-ledger`（同一检查点）
4. 详细步骤 → [Inbound PR 文档](../refs/opensource-ops-inbound-pr.md)

### C: Outbound PR

1. `[cat-cafe]` 确认 PR 类型 → 查官方 F 编号 → 本地编号对齐
2. `[cat-cafe]` Feature Doc 校验 + 质量门禁（`pnpm check` + `pnpm lint` + `test:public`）
3. `[clowder-ai]` 组装 PR（conventional commit 格式）
4. `[clowder-ai]` PR 创建后注册 PR tracking（CI 自动追踪，需要 prNumber）
5. 详细步骤 → [Outbound PR 文档](../refs/opensource-ops-outbound-pr.md)

### D: Outbound Sync

1. `[cat-cafe]` Baseline Verification + Pre-sync gate + diff preview
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

## 和其他 skill 的区别

| 容易混淆 | 用哪个 |
|---------|--------|
| 内部 cat-cafe PR 合入 main | `merge-gate` |
| 内部猫间 review | `request-review` / `receive-review` |
| 新 Feature 立项 | `feat-lifecycle`（但社区 issue 的关联检测会 ref 过来） |
| 纯代码开发 | `worktree` + `tdd` |
