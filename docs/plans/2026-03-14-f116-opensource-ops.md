# Open-Source Ops Skill Implementation Plan

**Feature:** F116 — `docs/features/F116-opensource-ops.md`
**Goal:** 建立统一的 `opensource-ops` skill，猫猫加载即可处理所有开源社区运营场景
**Acceptance Criteria:** AC-A1~A9 + AC-B1~B3（完整列表见 spec）
**Architecture:** SKILL.md 作为场景路由入口（精简），各场景细节拆到 `cat-cafe-skills/refs/` 下的独立 md
**Tech Stack:** 纯 Markdown + shell 命令引用
**前端验证:** No

---

## Straight-Line Check

**Finish line:** 猫猫加载 `opensource-ops` skill → 按触发条件路由到正确场景 → 按步骤操作 → 不需要翻 F059/SOP/脚本注释。

**Not building:**
- 新脚本（用现有 sync/intake/hotfix 脚本）
- 自动化 GitHub Actions（人工操作规范）
- community-pr 的代码改动（Phase B 才做迁移）

**Terminal deliverables:**
1. `cat-cafe-skills/opensource-ops/SKILL.md` — 场景路由 + 骨架步骤
2. `cat-cafe-skills/refs/opensource-ops-issue-triage.md` — 场景 A 细节
3. `cat-cafe-skills/refs/opensource-ops-inbound-pr.md` — 场景 B 细节
4. `cat-cafe-skills/refs/opensource-ops-outbound-sync.md` — 场景 C+D 细节
5. `cat-cafe-skills/refs/opensource-ops-labels.md` — 场景 E 细节（含标签真相源表）
6. `cat-cafe-skills/refs/opensource-ops-hotfix.md` — 场景 F 细节
7. `sync-manifest.yaml` 更新 — excluded 加 `cat-cafe-skills/opensource-ops/`
8. `manifest.yaml` 更新 — 加 `opensource-ops` 条目

---

## Task 1: SKILL.md 主文件（场景路由骨架）

**Files:**
- Create: `cat-cafe-skills/opensource-ops/SKILL.md`

**Step 1:** 写 SKILL.md，包含：
- frontmatter（name, description, use when, not for, output）
- 场景路由表（A~F 触发条件 + 对应 ref 链接）
- 贯穿规则：双仓边界（cat-cafe vs clowder-ai）
- 每个场景 3~5 行骨架步骤 + ref link 到详细 md

**Step 2:** 验证——SKILL.md ≤ 150 行，不含大段操作细节

**Step 3:** Commit

---

## Task 2: 场景 A — Issue Triage 详细文档

**Files:**
- Create: `cat-cafe-skills/refs/opensource-ops-issue-triage.md`

**Step 1:** 写 Issue Triage 详细步骤：
- 分类标准（bug / feature / enhancement / duplicate）
- 标签打法（ref → labels.md 标签真相源表）
- 关联检测（ref → feat-lifecycle Step 0）
- 互链评论模板（#14 ↔ #64 那种格式）
- 收敛/关单规则 + 关单评论模板
- 每个步骤标注 `[clowder-ai]` 或 `[cat-cafe]`

**Step 2:** Commit

---

## Task 3: 场景 B — Inbound PR 详细文档

**Files:**
- Create: `cat-cafe-skills/refs/opensource-ops-inbound-pr.md`

**Step 1:** 写 Inbound PR 详细步骤，分三个子 Gate：
- **B1 Merge Gate checklist**：① accepted issue ② CI/测试 ③ F 编号 + 关联检测 ④ intake 预判
- **B2 Merge 执行**：KD-4 Patch 自主 merge 4 条件 vs Feature 升级铲屎官
- **B3 Intake**：`intake-from-opensource.sh --pr N --mode=plan` → `--record` → `--advance-ledger` 完整命令
- 签名归属规则

**Step 2:** Commit

---

## Task 4: 场景 C+D — Outbound PR + Sync 详细文档

**Files:**
- Create: `cat-cafe-skills/refs/opensource-ops-outbound-sync.md`

**Step 1:** 写 Outbound 详细步骤：
- 场景 C：从现有 `community-pr` SKILL.md 提取核心步骤（不迁移，Phase A 只是 ref）
- 场景 D：sync 全流程 + PR 记录规范（KD-6：必须列清 feat/bugfix/改动）
- `sync-to-opensource.sh` 常用模式（dry-run / validate / full sync）

**Step 2:** Commit

---

## Task 5: 场景 E — Label & 归档详细文档

**Files:**
- Create: `cat-cafe-skills/refs/opensource-ops-labels.md`

**Step 1:** 写 Label 详细文档：
- **标签真相源表**：两列——"概念语义"和"GitHub 实际 label"
  - GitHub labels：`bug`, `enhancement`, `duplicate`, `feature:Fxxx`, `help wanted`, `good first issue`
  - 概念分类（非 GitHub label）：`safe-cherry-pick`, `manual-port`, `public-only`, `absorbed`, `rejected`（这些是 intake 决策类别）
- 缺失标签创建指引（`gh label create` 命令）
- 双仓标签归属规则
- 互链评论模板

**Step 2:** Commit

---

## Task 6: 场景 F — Hotfix Lane 详细文档

**Files:**
- Create: `cat-cafe-skills/refs/opensource-ops-hotfix.md`

**Step 1:** 写 Hotfix 详细步骤：
- worktree 基于 sync tag 创建
- `sync-hotfix.sh` 命令 + 参数
- clowder-ai PR 流程
- cherry-pick 回 main
- intake record + advance-ledger

**Step 2:** Commit

---

## Task 7: sync-manifest.yaml + manifest.yaml 更新

**Files:**
- Modify: `sync-manifest.yaml` — excluded 加 `cat-cafe-skills/opensource-ops/`
- Modify: `cat-cafe-skills/manifest.yaml` — 加 `opensource-ops` 条目

**Step 1:** 更新 sync-manifest.yaml excluded 列表
**Step 2:** 更新 manifest.yaml 加 skill 条目
**Step 3:** Commit

---

## Task 8: 最终验证

**Step 1:** 检查所有 AC（A1~A9）逐条对照
**Step 2:** 确认 SKILL.md ≤ 150 行
**Step 3:** 确认每个步骤标注了 `[cat-cafe]` 或 `[clowder-ai]`
**Step 4:** 最终 commit，@ 砚砚 review
