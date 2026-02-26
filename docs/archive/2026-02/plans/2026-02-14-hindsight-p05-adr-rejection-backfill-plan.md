---
feature_ids: []
topics: [hindsight, p05, adr]
doc_kind: plan
created: 2026-02-14
---

# Hindsight P0.5 #68 ADR 否决理由回填 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 批量回填历史 ADR 的“否决理由/不选方案 why”，让 Hindsight Recall 对“为什么不选 X”问题可稳定命中。

**Architecture:** 采用“文档先行、实现零侵入”的策略：仅修改已追踪 ADR 文档，不改 importer/runtime 代码。先建立统一回填模板，再逐 ADR 回填并用可执行校验命令做 Red→Green 验证，最后在 ADR-005 附录追加本次回填索引作为审计锚点。

**Tech Stack:** Markdown ADR 文档、`rg`/`bash` 校验命令、Git 提交审计

---

## 五件套开工定义（#68）

### What

- 范围：`docs/decisions/` 下已追踪的历史 ADR（`001/002/003/007/008/009-cat-cafe-skills`）。
- 动作：为每个 ADR 增加标准化回填段 `## 否决理由（P0.5 回填）`，明确“备选方案 + 不选原因 + 边界”。
- 落盘：
  - 主体落盘：各 ADR 文件自身。
  - 汇总落盘：`docs/decisions/005-hindsight-integration-decisions.md` 新增附录（本轮回填索引）。

**目标文件清单（git-tracked）**

1. `docs/decisions/001-agent-invocation-approach.md`
2. `docs/decisions/002-collaboration-protocol.md`
3. `docs/decisions/003-project-thread-architecture.md`
4. `docs/decisions/007-cascade-delete-semantics.md`
5. `docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md`
6. `docs/decisions/009-cat-cafe-skills-distribution.md`

排除项：未被 `git ls-files docs/decisions/*.md` 追踪的草稿 ADR（例如 `010-directory-hygiene-anti-rot.md`）。

### Why

- 当前部分 ADR 有 tradeoff 线索，但检索锚点不统一，Recall 对“为什么不用 X”命中不稳定。
- #68 属于低风险高价值：只改文档，不动运行时，能直接提升 evidence 的 why 维度可检索性。

### Tradeoff

- 选择“统一模板 + 批量回填”，放弃“保持现状按需补写”。
- 成本：本轮会引入一次较大文档 diff。
- 收益：减少后续讨论重复追问历史取舍，降低误读成本。

### Open Questions

1. ADR-008 已有多处 `Tradeoff`，是否只加顶层索引，不重复细节？
2. ADR-002 以协议为主，是否将“否决理由”写在执行成本层面而非技术对比层面？
3. #68 合入 `main` 后是否将“导入 + 健康检查”接入 CI 自动化（本轮先手动固定动作，自动化放入 #71）？

### Next Action

- 按下方 Task 1-7 执行。
- 每个任务完成即 commit（小步提交，便于交叉 review）。

---

## DoD（Done Definition）

1. 目标 ADR 均包含 `## 否决理由（P0.5 回填）` 标准段。
2. 每个标准段至少含 2 个“备选方案→不选原因”条目，并含“不做边界”一句。
3. `docs/decisions/005-hindsight-integration-decisions.md` 有本轮 #68 回填索引（文件清单 + commit 锚点占位）。
4. 验收命令全部通过（见下文）。
5. #68 合入 `main` 后执行一次 `hindsight:import:p0 -- --all` + `p0-health-check`，并把结果写入 ADR-005 附录 E。

## 验收命令

```bash
# 1) 标准段存在性（必须全通过）
for f in \
  docs/decisions/001-agent-invocation-approach.md \
  docs/decisions/002-collaboration-protocol.md \
  docs/decisions/003-project-thread-architecture.md \
  docs/decisions/007-cascade-delete-semantics.md \
  docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md \
  docs/decisions/009-cat-cafe-skills-distribution.md; do
  rg -q "^## 否决理由（P0\.5 回填）$" "$f" || { echo "MISSING: $f"; exit 1; }
done

# 2) 回填段最小密度检查（每个文件至少 2 条备选方案）
for f in \
  docs/decisions/001-agent-invocation-approach.md \
  docs/decisions/002-collaboration-protocol.md \
  docs/decisions/003-project-thread-architecture.md \
  docs/decisions/007-cascade-delete-semantics.md \
  docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md \
  docs/decisions/009-cat-cafe-skills-distribution.md; do
  c=$(awk '/^## 否决理由（P0.5 回填）$/{p=1;next} /^## /&&p{p=0} p{print}' "$f" | rg -c "^- \*\*备选方案")
  [ "$c" -ge 2 ] || { echo "TOO_THIN: $f ($c)"; exit 1; }
done

# 3) ADR-005 汇总索引存在
rg -n "#68 回填索引|ADR 否决理由回填索引" docs/decisions/005-hindsight-integration-decisions.md

# 4) 合入 main 后固定收口动作（仅当本次合入涉及可导入源）
pnpm --filter @cat-cafe/api hindsight:import:p0 -- --all
bash scripts/hindsight/p0-health-check.sh
```

## 不做边界（防范围蔓延）

- 不修改任何 importer/runtime/API 代码。
- 不处理未追踪草稿（例如未入 Git 的 ADR 文件）。
- 不在 #68 引入 discussion 例外导入机制（那是 #67 范围）。
- 不在 #68 落地周评测流水线（那是 #69 范围）。

---

### Task 1: 固化 #68 回填规范与文件清单

**Files:**
- Modify: `docs/plans/2026-02-14-hindsight-p05-adr-rejection-backfill-plan.md`
- Read: `docs/BACKLOG.md`

**Step 1: 写失败校验命令（Red）**

运行“标准段存在性”命令，预期当前会失败（因尚未回填）。

**Step 2: 固化目标 ADR 清单**

在本计划文档中锁定 6 个目标 ADR 文件，排除未追踪草稿。

**Step 3: Run Red 验证**

Run: 上述命令。
Expected: 至少 1 个 `MISSING`。

**Step 4: Commit**

```bash
git add docs/plans/2026-02-14-hindsight-p05-adr-rejection-backfill-plan.md
git commit -m "docs(plan): define #68 ADR rejection backfill scope and DoD [缅因猫🐾]" -m "Why: 先锁定范围和验收口径，避免回填过程范围漂移。"
```

### Task 2: 回填 ADR-001 与 ADR-002

**Files:**
- Modify: `docs/decisions/001-agent-invocation-approach.md`
- Modify: `docs/decisions/002-collaboration-protocol.md`

**Step 1: 写回填段（最小模板）**

每个文件新增：

```md
## 否决理由（P0.5 回填）

- **备选方案 A**：...
  - 不选原因：...
- **备选方案 B**：...
  - 不选原因：...

**不做边界**：...
```

**Step 2: Run 文件级校验（Green）**

Run:
```bash
for f in docs/decisions/001-agent-invocation-approach.md docs/decisions/002-collaboration-protocol.md; do
  rg -n "^## 否决理由（P0\.5 回填）$|^\- \*\*备选方案|^\*\*不做边界\*\*" "$f"
done
```
Expected: 每个文件均命中标准段、≥2 个备选方案、1 个不做边界。

**Step 3: Commit**

```bash
git add docs/decisions/001-agent-invocation-approach.md docs/decisions/002-collaboration-protocol.md
git commit -m "docs(adr): backfill rejection rationale for ADR-001/002 [缅因猫🐾]" -m "Why: 先补最早两份 ADR 的 why 缺口，建立统一回填样式。"
```

### Task 3: 回填 ADR-003 与 ADR-007

**Files:**
- Modify: `docs/decisions/003-project-thread-architecture.md`
- Modify: `docs/decisions/007-cascade-delete-semantics.md`

**Step 1: 写回填段并避免与原有章节冲突**

- ADR-003 已有“放弃的方案”，新段聚焦“最终不选原因摘要 + 证据锚点”。
- ADR-007 已有“为什么不用强一致性”，新段做标准化抽取，避免重复长段。

**Step 2: Run 文件级校验（Green）**

Run:
```bash
for f in docs/decisions/003-project-thread-architecture.md docs/decisions/007-cascade-delete-semantics.md; do
  rg -n "^## 否决理由（P0\.5 回填）$|^\- \*\*备选方案|^\*\*不做边界\*\*" "$f"
done
```
Expected: 两文件均满足标准段结构。

**Step 3: Commit**

```bash
git add docs/decisions/003-project-thread-architecture.md docs/decisions/007-cascade-delete-semantics.md
git commit -m "docs(adr): standardize rejection rationale for ADR-003/007 [缅因猫🐾]" -m "Why: 把已有 tradeoff 内容转为统一检索锚点格式，提升 Recall 可命中性。"
```

### Task 4: 回填 ADR-008 与 ADR-009

**Files:**
- Modify: `docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md`
- Modify: `docs/decisions/009-cat-cafe-skills-distribution.md`

**Step 1: ADR-008 采用“索引式回填”**

- 不复制 D1-D5 全文细节。
- 在新标准段按 D1-D5 给出“不选方案索引 + 指向原章节”。

**Step 2: ADR-009 增加显式否决映射**

- 将现有 `Tradeoff` 转为“备选方案→不选原因”标准条目。

**Step 3: Run 文件级校验（Green）**

Run:
```bash
for f in docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md docs/decisions/009-cat-cafe-skills-distribution.md; do
  rg -n "^## 否决理由（P0\.5 回填）$|^\- \*\*备选方案|^\*\*不做边界\*\*" "$f"
done
```
Expected: 两文件均满足结构。

**Step 4: Commit**

```bash
git add docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md docs/decisions/009-cat-cafe-skills-distribution.md
git commit -m "docs(adr): add rejection rationale index for ADR-008/009 [缅因猫🐾]" -m "Why: 统一高复杂 ADR 的 why 检索入口，避免 Recall 时只命中实现细节。"
```

### Task 5: 更新 ADR-005 附录索引（#68 审计锚点）

**Files:**
- Modify: `docs/decisions/005-hindsight-integration-decisions.md`

**Step 1: 新增 #68 回填索引附录**

建议新增小节：

```md
## 附录 E：ADR 否决理由回填索引（P0.5 #68）
- 回填范围：...
- 验收命令：...
- commit 锚点：...
```

**Step 2: Run 索引存在性校验**

Run:
```bash
rg -n "附录 E：ADR 否决理由回填索引（P0\.5 #68）" docs/decisions/005-hindsight-integration-decisions.md
```
Expected: 命中 1 条。

**Step 3: Commit**

```bash
git add docs/decisions/005-hindsight-integration-decisions.md
git commit -m "docs(adr-005): add #68 rejection backfill index appendix [缅因猫🐾]" -m "Why: 在治理总 ADR 中补审计锚点，确保回填工作可追溯。"
```

### Task 6: 全量验收（Red→Green 关账）

**Files:**
- Verify: `docs/decisions/*.md`

**Step 1: 跑三条验收命令**

运行本计划“验收命令”全部三条。

**Step 2: 处理失败并重跑至全绿**

若出现 `MISSING` / `TOO_THIN`，逐文件补齐并重跑。

**Step 3: Commit**

```bash
git add docs/decisions/*.md docs/plans/2026-02-14-hindsight-p05-adr-rejection-backfill-plan.md
git commit -m "docs(p0.5): close #68 ADR rejection rationale backfill [缅因猫🐾]" -m "Why: 通过统一模板与可执行验收命令，完成历史 ADR why 维度回填。"
```

### Task 7: 交叉 Review 交接（五件套）

**Files:**
- Create: `docs/mailbox/2026-02-14-p05-adr68-review-request-to-opus.md`

**Step 1: 按五件套写 review 信**

必须包含：What / Why / Tradeoff / Open Questions / Next Action。

**Step 2: 附证据**

在信里附：
- 验收命令输出摘要
- 关键 commit 列表
- 边界声明（明确未触及 #67/#69）

**Step 3: Commit**

```bash
git add docs/mailbox/2026-02-14-p05-adr68-review-request-to-opus.md
git commit -m "docs(mailbox): request cross-review for P0.5 #68 closure [缅因猫🐾]" -m "Why: 先做跨猫验收，再进入 #67，避免范围串线。"
```

---

Plan complete and saved to `docs/plans/2026-02-14-hindsight-p05-adr-rejection-backfill-plan.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
